import client from "./client"
import type { Transaction, TransactionFilters, TransactionFormData } from "@/types"

export const getTransactions = async (filters: TransactionFilters): Promise<Transaction[]> => {
  const params: Record<string, string | number> = {}
  if (filters.from !== undefined) params.from = filters.from
  if (filters.to !== undefined) params.to = filters.to
  if (filters.start) params.start = filters.start
  if (filters.end) params.end = filters.end
  const { data } = await client.get("/transactions", { params })
  return data
}

export const addTransaction = async (body: TransactionFormData): Promise<void> => {
  await client.post("/transactions", body)
}

export const addIncomeTransaction = async (body: TransactionFormData): Promise<void> => {
  await client.post("/incomes/transactions", body)
}

export const updateTransaction = async (id: number, body: TransactionFormData): Promise<void> => {
  await client.put(`/transactions/${id}`, body)
}

export const deleteTransaction = async (id: number): Promise<void> => {
  await client.delete(`/transactions/${id}`)
}
