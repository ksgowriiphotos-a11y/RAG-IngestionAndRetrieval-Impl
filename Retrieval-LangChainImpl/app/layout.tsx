import './globals.css';

export const metadata = {
  title: 'RAG Pipeline Dashboard',
  description: 'User Story RAG Pipeline with Ingestion and Retrieval',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
