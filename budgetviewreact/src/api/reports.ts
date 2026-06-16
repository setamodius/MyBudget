import client from "./client"
import type { Summary, BoxReport, BoxType, ExpenseBreakdown, PeriodSummaryRow } from "@/types"

export const getSummaries = async (): Promise<Summary[]> => {
  const { data } = await client.get("/summaries")
  return data
}

export const getBoxReport = async (type: BoxType, id: number): Promise<BoxReport[]> => {
  const { data } = await client.get(`/${type}/${id}/reports`)
  return data
}

export const getAllBoxReport = async (type: BoxType): Promise<BoxReport[]> => {
  const { data } = await client.get(`/${type}/reports`)
  return data
}

export const getMonthlyExpenseBreakdown = async (month: string): Promise<ExpenseBreakdown[]> => {
  const { data } = await client.get("/expensetypes/monthly-breakdown", { params: { month } })
  return data
}

export const getPeriodSummary = async (params: { start?: string; end?: string }): Promise<PeriodSummaryRow[]> => {
  const { data } = await client.get("/period-summary", { params })
  return data
}
