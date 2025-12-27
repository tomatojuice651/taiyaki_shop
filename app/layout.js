import './globals.css'

export const metadata = {
  title: '鯛魚燒商城 | Taiyaki Shop',
  description: '使用鯛魚燒點數兌換獎品',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
