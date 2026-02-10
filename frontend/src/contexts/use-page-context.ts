import { useContext } from "react"
import { PageContext } from "@/contexts/page-context"

export function usePageContext() {
  const context = useContext(PageContext)
  if (context === undefined) {
    throw new Error("usePageContext must be used within a PageProvider")
  }
  return context
}
