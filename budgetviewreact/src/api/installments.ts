import client from "./client"
import type {
  InstallmentPlan, InstallmentPlanDetail, InstallmentPlanFormData,
  InstallmentResolveRow, InstallmentResolveResult, InstallmentScan,
} from "@/types"

export const getInstallmentPlans = async (): Promise<InstallmentPlan[]> => {
  const { data } = await client.get("/installment-plans")
  return data
}

export const getInstallmentPlanDetail = async (id: number): Promise<InstallmentPlanDetail[]> => {
  const { data } = await client.get(`/installment-plans/${id}`)
  return data
}

export const createInstallmentPlan = async (body: InstallmentPlanFormData): Promise<{ id: number }> => {
  const { data } = await client.post("/installment-plans", body)
  return data
}

export const updateInstallmentPlan = async (
  id: number,
  body: { description?: string; expense_box_id?: number }
): Promise<void> => {
  await client.put(`/installment-plans/${id}`, body)
}

export const deleteInstallmentPlan = async (id: number): Promise<void> => {
  await client.delete(`/installment-plans/${id}`)
}

export const linkToPlan = async (id: number, tx_ids: number[]): Promise<void> => {
  await client.post(`/installment-plans/${id}/link`, { tx_ids })
}

export const fillPlanBudget = async (id: number): Promise<void> => {
  await client.post(`/installment-plans/${id}/fill`)
}

export const resolveInstallments = async (
  card: number,
  rows: InstallmentResolveRow[]
): Promise<InstallmentResolveResult[]> => {
  const { data } = await client.post("/installment-plans/resolve", { card, rows })
  return data
}

export const scanInstallments = async (): Promise<InstallmentScan> => {
  const { data } = await client.get("/installment-plans/scan")
  return data
}

export const installmentizeTransaction = async (
  id: number,
  body: { total_installments: number; card_txns: boolean; description?: string; expense_box_id?: number }
): Promise<{ id: number }> => {
  const { data } = await client.post(`/transactions/${id}/installmentize`, body)
  return data
}
