// CSV download helper — fetches a protected CSV endpoint with the stored JWT
// and triggers a browser file download.
import { getStoredToken } from './api'

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = getStoredToken()
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
  const url = API_BASE ? `${API_BASE}${path}` : path
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const txt = await res.text()
      if (txt) detail = txt.slice(0, 200)
    } catch {
      // ignore
    }
    throw new Error(`Download failed: ${detail}`)
  }
  const blob = await res.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Release the object URL after a short delay to ensure the download has started.
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}
