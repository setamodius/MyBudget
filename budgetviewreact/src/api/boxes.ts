import client from "./client"
import type { Box, BoxFormData, BoxType, BoxTypeInfo } from "@/types"

export const getBoxTypes = async (): Promise<BoxTypeInfo[]> => {
  const { data } = await client.get("/boxtypes")
  return data
}

export const getBoxes = async (type: BoxType): Promise<Box[]> => {
  const { data } = await client.get(`/${type}`)
  return data
}

export const getAllBoxes = async (): Promise<Box[]> => {
  const { data } = await client.get("/boxes")
  return data
}

export const addBox = async (type: BoxType, body: BoxFormData): Promise<void> => {
  await client.post(`/${type}`, body)
}

export const updateBox = async (type: BoxType, id: number, body: BoxFormData): Promise<void> => {
  await client.put(`/${type}/${id}`, body)
}

export const deleteBox = async (type: BoxType, id: number): Promise<void> => {
  await client.delete(`/${type}/${id}`)
}
