import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

const newFlowTheme = {
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorSuccess: '#16835d',
    colorWarning: '#c58519',
    colorError: '#d83a47',
    colorText: '#17263e',
    colorTextSecondary: '#64748b',
    colorBorder: '#dfe6ef',
    colorBgLayout: '#f5f7fb',
    colorBgContainer: '#ffffff',
    fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    borderRadius: 10,
    controlHeight: 36,
  },
  components: {
    Button: { fontWeight: 600, controlHeight: 36 },
    Card: { headerFontSize: 15, headerFontSizeSM: 14 },
    Table: { headerBg: '#f7f9fc', headerColor: '#46566e' },
    Menu: { itemBorderRadius: 9, itemHeight: 40 },
    Tabs: { titleFontSize: 14, horizontalItemPadding: '12px 0' },
    Form: { labelColor: '#46566e' },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider theme={newFlowTheme}><App /></ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
