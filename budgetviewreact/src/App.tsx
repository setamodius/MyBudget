import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/AppLayout"
import { StatusPage } from "@/pages/StatusPage"
import { AddPage } from "@/pages/AddPage"
import { PlanPage } from "@/pages/PlanPage"
import { DefinitionsPage } from "@/pages/DefinitionsPage"
import { TransactionsPage } from "@/pages/TransactionsPage"
import { HesaplarPage } from "@/pages/HesaplarPage"
import { BoxDetailPage } from "@/pages/BoxDetailPage"
import { AnalizPage } from "@/pages/AnalizPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<StatusPage />} />
            <Route path="ekle" element={<AddPage />} />
            <Route path="islemler" element={<TransactionsPage />} />
            <Route path="hesaplar" element={<HesaplarPage />} />
            <Route path="hesaplar/:id" element={<BoxDetailPage />} />
            <Route path="plan" element={<PlanPage />} />
            <Route path="analiz" element={<AnalizPage />} />
            {/* Eski adresler */}
            <Route path="harcamalar" element={<Navigate to="/analiz?tab=butce" replace />} />
            <Route path="raporlar" element={<Navigate to="/analiz?tab=raporlar" replace />} />
            <Route path="akis" element={<Navigate to="/analiz?tab=akis" replace />} />
            <Route path="ayarlar" element={<DefinitionsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
