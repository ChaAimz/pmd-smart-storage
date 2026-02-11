/* eslint-disable no-console */
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3001';
const ADMIN_USER = process.env.SMOKE_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS || 'admin123';

const state = {
  token: '',
  sampleItemId: null,
  sampleLocationAddress: null,
  samplePrId: null,
  samplePrItemId: null,
  tempCategoryId: null,
  tempItemId: null,
};

const results = [];

function ok(message) {
  console.log(`PASS  ${message}`);
}

function warn(message) {
  console.log(`SKIP  ${message}`);
}

function fail(message) {
  console.log(`FAIL  ${message}`);
}

async function request(method, path, body, expectedStatus = [200]) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (error) {
    data = { raw };
  }

  if (!expectedStatus.includes(response.status)) {
    throw new Error(`${method} ${path} => ${response.status}, expected ${expectedStatus.join(', ')}`);
  }

  return { status: response.status, data, response };
}

async function run(name, fn, optional = false) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, status: 'pass', ms: Date.now() - started });
    ok(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (optional) {
      results.push({ name, status: 'skip', ms: Date.now() - started, message });
      warn(`${name} (${message})`);
      return;
    }
    results.push({ name, status: 'fail', ms: Date.now() - started, message });
    fail(`${name} (${message})`);
  }
}

async function smoke() {
  await run('health check', async () => {
    const { data } = await request('GET', '/health', undefined, [200]);
    if (!data || data.status !== 'ok') {
      throw new Error('invalid health payload');
    }
  });

  await run('auth login returns token+user', async () => {
    const { data } = await request('POST', '/api/auth/login', {
      username: ADMIN_USER,
      password: ADMIN_PASS,
    });
    if (!data?.success || !data?.data?.token || !data?.data?.user?.id) {
      throw new Error('login response missing token/user');
    }
    state.token = data.data.token;
  });

  await run('items list', async () => {
    const { data } = await request('GET', '/api/items');
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('items payload invalid');
    }
    state.sampleItemId = data.data[0]?.id ?? null;
  });

  await run('locations list', async () => {
    const { data } = await request('GET', '/api/locations');
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('locations payload invalid');
    }
    state.sampleLocationAddress = data.data[0]?.node_address ?? null;
  });

  await run('stats endpoint', async () => {
    const { data } = await request('GET', '/api/stats');
    if (!data?.success || !data?.data) {
      throw new Error('stats payload invalid');
    }
  });

  await run('transactions list', async () => {
    const { data } = await request('GET', '/api/transactions?limit=10');
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('transactions payload invalid');
    }
  });

  await run('low stock list', async () => {
    const { data } = await request('GET', '/api/items/low-stock');
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('low-stock payload invalid');
    }
  });

  await run('categories list/create/update/delete', async () => {
    const listResp = await request('GET', '/api/categories?include_inactive=true');
    if (!listResp.data?.success || !Array.isArray(listResp.data.data)) {
      throw new Error('category list payload invalid');
    }

    const uniqueName = `SmokeCategory-${Date.now()}`;
    const createResp = await request('POST', '/api/categories', {
      name: uniqueName,
      color: '#2563EB',
      is_active: true,
    }, [201, 200]);
    if (!createResp.data?.success || !createResp.data?.data?.id) {
      throw new Error('category create failed');
    }

    state.tempCategoryId = createResp.data.data.id;

    const updateResp = await request('PUT', `/api/categories/${state.tempCategoryId}`, {
      color: '#16A34A',
    });
    if (!updateResp.data?.success) {
      throw new Error('category update failed');
    }

    const deleteResp = await request('DELETE', `/api/categories/${state.tempCategoryId}`);
    if (!deleteResp.data?.success) {
      throw new Error('category delete failed');
    }
    state.tempCategoryId = null;
  });

  await run('create/update/delete item', async () => {
    const uniqueSku = `SMK-${Date.now()}`;
    const createResp = await request('POST', '/api/items', {
      sku: uniqueSku,
      name: 'Smoke Test Item',
      category: 'Electronics',
      unit: 'pcs',
      reorder_point: 5,
      reorder_quantity: 10,
      safety_stock: 2,
      lead_time_days: 7,
      unit_cost: 1.25,
    });
    if (!createResp.data?.success || !createResp.data?.data?.id) {
      throw new Error('item create failed');
    }
    state.tempItemId = createResp.data.data.id;

    const updateResp = await request('PUT', `/api/items/${state.tempItemId}`, {
      name: 'Smoke Test Item Updated',
      supplier_name: 'Smoke Supplier',
    });
    if (!updateResp.data?.success) {
      throw new Error('item update failed');
    }

    const deleteResp = await request('DELETE', `/api/items/${state.tempItemId}`);
    if (!deleteResp.data?.success) {
      throw new Error('item delete failed');
    }
    state.tempItemId = null;
  });

  await run('create transaction', async () => {
    if (!state.sampleItemId) {
      throw new Error('no sample item id');
    }
    const txResp = await request('POST', '/api/transactions', {
      item_id: state.sampleItemId,
      transaction_type: 'adjust',
      quantity: 1,
      notes: 'smoke test adjust +1',
      user_id: 1,
    });
    if (!txResp.data?.success || !txResp.data?.data?.id) {
      throw new Error('transaction create failed');
    }
  });

  await run('master items list', async () => {
    const { data } = await request('GET', '/api/master-items?search=');
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('master-items payload invalid');
    }
  });

  await run('PR list/detail/export/create/eta/receive flow', async () => {
    const prList = await request('GET', '/api/prs');
    if (!prList.data?.success || !Array.isArray(prList.data.data)) {
      throw new Error('prs list invalid');
    }

    const masterItemsResp = await request('GET', '/api/master-items?search=');
    const masterItem = masterItemsResp.data?.data?.[0];
    if (!masterItem?.id) {
      throw new Error('no master item for PR create');
    }

    const today = new Date().toISOString().slice(0, 10);
    const createPrResp = await request('POST', '/api/prs', {
      priority: 'normal',
      required_date: today,
      notes: 'smoke pr create',
      items: [
        {
          master_item_id: masterItem.id,
          quantity: 2,
          estimated_unit_cost: 3.5,
          notes: 'line for smoke',
        },
      ],
    }, [201, 200]);

    if (!createPrResp.data?.success || !createPrResp.data?.data?.id) {
      throw new Error('pr create failed');
    }
    state.samplePrId = createPrResp.data.data.id;

    const detail = await request('GET', `/api/prs/${state.samplePrId}`);
    if (!detail.data?.success || !Array.isArray(detail.data?.data?.items)) {
      throw new Error('pr detail invalid');
    }
    state.samplePrItemId = detail.data.data.items[0]?.id ?? null;

    const exportResp = await request('GET', `/api/prs/${state.samplePrId}/export`);
    if (!exportResp.data?.success || !Array.isArray(exportResp.data?.data?.items)) {
      throw new Error('pr export invalid');
    }

    const etaResp = await request('POST', `/api/prs/${state.samplePrId}/eta`, {
      required_date: today,
      reason: 'smoke eta check',
    });
    if (!etaResp.data?.success) {
      throw new Error('pr eta update failed');
    }

    if (state.samplePrItemId) {
      const receiveResp = await request('POST', `/api/prs/${state.samplePrId}/receive`, {
        po_number: `SMOKE-PO-${Date.now()}`,
        received_date: today,
        items: [
          {
            pr_item_id: state.samplePrItemId,
            received_quantity: 1,
          },
        ],
      });
      if (!receiveResp.data?.success) {
        throw new Error('pr receive failed');
      }
    }
  });

  await run('notifications list + unread + read-all', async () => {
    const unread = await request('GET', '/api/notifications/unread-count');
    if (!unread.data?.success || typeof unread.data?.data?.count !== 'number') {
      throw new Error('notification unread-count invalid');
    }

    const list = await request('GET', '/api/notifications?limit=20');
    if (!list.data?.success || !Array.isArray(list.data?.data)) {
      throw new Error('notification list invalid');
    }

    if (list.data.data.length > 0) {
      const id = list.data.data[0].id;
      const markOne = await request('POST', `/api/notifications/${id}/read`, {});
      if (!markOne.data?.success) {
        throw new Error('notification mark read failed');
      }
    }

    const markAll = await request('POST', '/api/notifications/read-all', {});
    if (!markAll.data?.success) {
      throw new Error('notification mark-all failed');
    }
  });

  await run('notification SSE stream handshake', async () => {
    const response = await fetch(`${BASE_URL}/api/notifications/stream`, {
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : undefined,
    });
    if (response.status !== 200 || !response.body) {
      throw new Error(`invalid stream response: ${response.status}`);
    }
    const reader = response.body.getReader();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('stream timeout')), 2500)
    );
    const chunkPromise = reader.read();
    const first = await Promise.race([chunkPromise, timeout]);
    await reader.cancel();
    if (!first || first.done || !first.value) {
      throw new Error('stream did not return first chunk');
    }
  }, true);

  await run('search endpoint', async () => {
    const { data } = await request('GET', '/api/search?q=A');
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('search payload invalid');
    }
  });

  await run('location events endpoint', async () => {
    if (!state.sampleLocationAddress) {
      throw new Error('no sample location');
    }
    const { data } = await request('GET', `/api/locations/${state.sampleLocationAddress}/events`);
    if (!data?.success || !Array.isArray(data.data)) {
      throw new Error('location events payload invalid');
    }
  });
}

function printSummaryAndExit() {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'pass').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log('\n--- Smoke Test Summary ---');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Total: ${total}  Passed: ${passed}  Skipped: ${skipped}  Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailures:');
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => console.log(`- ${r.name}: ${r.message}`));
    process.exit(1);
  }

  process.exit(0);
}

smoke()
  .then(printSummaryAndExit)
  .catch((error) => {
    fail(`fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
