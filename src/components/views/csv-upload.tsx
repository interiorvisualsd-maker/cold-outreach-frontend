'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileSpreadsheet,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  FileUp,
  Check,
  X,
} from 'lucide-react'
import { EmptyState } from './dashboard'

interface Campaign {
  id: string
  name: string
  status: string
  _count: { leads: number }
}

interface ParseResponse {
  filename: string
  totalRows: number
  headers: string[]
  detectedMapping: Record<string, string>
  preview: Array<Record<string, string>>
  validation: {
    hasEmail: boolean
    hasSubject: boolean
    hasBody: boolean
    ready: boolean
    missing: string[]
  }
}

interface ImportResponse {
  imported: number
  duplicates: number
  suppressed: number
  invalid: number
  skipped: Array<{ row: Record<string, unknown>; reason: string }>
}

const CANONICAL_COLUMNS = [
  'company_name',
  'emails',
  'website',
  'state',
  'industry',
  'outreach_subject',
  'initial_outreach',
  'followup_day3',
  'followup_day7',
] as const

type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number]

const REQUIRED_COLUMNS: CanonicalColumn[] = ['emails', 'outreach_subject', 'initial_outreach']

export function CsvUploadView() {
  const { toast } = useToast()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [allRows, setAllRows] = useState<Array<Record<string, string>>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true)
    try {
      const res = await api.get<{ campaigns: Campaign[] }>('/api/campaigns')
      setCampaigns(res.campaigns || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Failed to load campaigns', description: msg, variant: 'destructive' })
    } finally {
      setCampaignsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  const handleFile = (f: File | null) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast({ title: 'Not a CSV', description: 'Please select a .csv file', variant: 'destructive' })
      return
    }
    setFile(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const parseFile = async () => {
    if (!file) {
      toast({ title: 'Select a file first', variant: 'destructive' })
      return
    }
    if (!selectedCampaign) {
      toast({ title: 'Select a campaign', variant: 'destructive' })
      return
    }
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.upload<ParseResponse>('/api/csv/parse', fd)
      setParsed(res)
      setMapping(res.detectedMapping || {})
      // We need to fetch all rows from the file too (parse only returns preview).
      // Re-read the file client-side to capture all rows for import.
      const text = await file.text()
      const rows = parseCsvLocal(text)
      setAllRows(rows)
      setStep(2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Parse failed'
      toast({ title: 'Failed to parse CSV', description: msg, variant: 'destructive' })
    } finally {
      setParsing(false)
    }
  }

  const updateMapping = (csvHeader: string, canonical: string) => {
    setMapping((m) => {
      const next = { ...m }
      if (canonical === '__none__') {
        delete next[csvHeader]
      } else {
        // Remove any other csvHeader that already points to this canonical
        for (const [k, v] of Object.entries(next)) {
          if (v === canonical) delete next[k]
        }
        next[csvHeader] = canonical
      }
      return next
    })
  }

  const doImport = async () => {
    if (!parsed || !selectedCampaign) return
    setImporting(true)
    try {
      const res = await api.post<ImportResponse>('/api/csv/import', {
        campaignId: selectedCampaign,
        filename: parsed.filename,
        rows: allRows,
        mapping,
      })
      setImportResult(res)
      setStep(3)
      toast({
        title: 'Import complete',
        description: `${res.imported} leads imported`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      toast({ title: 'Failed to import', description: msg, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep(1)
    setFile(null)
    setParsed(null)
    setMapping({})
    setAllRows([])
    setImportResult(null)
  }

  // Compute live validation from current mapping
  const mappedCanonicals = new Set(Object.values(mapping))
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !mappedCanonicals.has(c))
  const canImport = missingRequired.length === 0 && Object.keys(mapping).length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import CSV</h1>
          <p className="text-sm text-muted-foreground">Upload leads with smart column mapping</p>
        </div>
        <a
          href="/api/csv/template?XTransformPort=3001"
          download
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-4 w-4" />
          Template
        </a>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n, idx) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium border ${
                step >= n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border'
              }`}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            <span
              className={`text-sm font-medium ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {n === 1 ? 'Select & Upload' : n === 2 ? 'Map Columns' : 'Import Results'}
            </span>
            {idx < 2 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: select campaign + upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Step 1 — Select Campaign & Upload File
            </CardTitle>
            <CardDescription>Choose a destination campaign and your CSV file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Target Campaign</Label>
              {campaignsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
                </div>
              ) : campaigns.length === 0 ? (
                <EmptyState
                  icon={<FileSpreadsheet className="h-8 w-8" />}
                  title="No campaigns available"
                  description="Create a campaign first under the Campaigns tab before importing leads."
                />
              ) : (
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c._count.leads} leads)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <>
                  <FileSpreadsheet className="h-10 w-10 text-emerald-600 mb-2" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="font-medium">Drop CSV here or click to browse</p>
                  <p className="text-sm text-muted-foreground">Any filename · .csv format</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={parseFile}
                disabled={!file || !selectedCampaign || parsing || campaigns.length === 0}
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Parse & Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: mapping */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Mapping</CardTitle>
              <CardDescription>
                {parsed.filename} · {parsed.totalRows} rows · {parsed.headers.length} columns. Adjust mappings below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-y-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CSV Header</TableHead>
                      <TableHead className="w-8 text-center">→</TableHead>
                      <TableHead>Maps To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.headers.map((h) => (
                      <TableRow key={h}>
                        <TableCell className="font-medium">{h}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 inline" />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping[h] || '__none__'}
                            onValueChange={(v) => updateMapping(h, v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— ignore —</SelectItem>
                              {CANONICAL_COLUMNS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Validation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {canImport ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  Validation
                </CardTitle>
                <CardDescription>Required columns for a successful import</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {REQUIRED_COLUMNS.map((c) => {
                  const ok = mappedCanonicals.has(c)
                  return (
                    <div key={c} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{c}</span>
                      {ok ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <Check className="h-3 w-3" /> Mapped
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                          <X className="h-3 w-3" /> Missing
                        </Badge>
                      )}
                    </div>
                  )
                })}
                {missingRequired.length > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    Map the missing columns above to enable Import.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Preview (first 5 rows)</CardTitle>
                <CardDescription>Sample data from the uploaded file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-auto -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {parsed.headers.slice(0, 6).map((h) => (
                          <TableHead key={h} className="text-xs">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.preview.map((row, idx) => (
                        <TableRow key={idx}>
                          {parsed.headers.slice(0, 6).map((h) => (
                            <TableCell key={h} className="text-xs max-w-[160px] truncate">
                              {row[h] || '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={doImport} disabled={!canImport || importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import {parsed.totalRows} Rows
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: results */}
      {step === 3 && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Import Complete
            </CardTitle>
            <CardDescription>Summary of your CSV import</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">{importResult.imported}</p>
                <p className="text-xs text-muted-foreground mt-1">Imported</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{importResult.duplicates}</p>
                <p className="text-xs text-muted-foreground mt-1">Duplicates</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-rose-600">{importResult.suppressed}</p>
                <p className="text-xs text-muted-foreground mt-1">Suppressed</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-slate-600">{importResult.invalid}</p>
                <p className="text-xs text-muted-foreground mt-1">Invalid</p>
              </div>
            </div>

            {importResult.skipped.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Skipped rows (first {importResult.skipped.length}):
                </p>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reason</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.skipped.map((s, idx) => {
                        const email =
                          (s.row && (s.row as Record<string, unknown>).emails) ||
                          (s.row && (s.row as Record<string, unknown>).email) ||
                          '—'
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  s.reason === 'duplicate'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : s.reason === 'suppressed'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-slate-50 text-slate-700 border-slate-200'
                                }
                              >
                                {s.reason}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{String(email)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Minimal RFC-ish CSV parser (handles quoted fields with commas + newlines)
function parseCsvLocal(text: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cur.push(field)
        field = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        cur.push(field)
        field = ''
        if (cur.some((c) => c.length > 0)) rows.push(cur)
        cur = []
      } else {
        field += ch
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field)
    if (cur.some((c) => c.length > 0)) rows.push(cur)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  const out: Array<Record<string, string>> = []
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (rows[r][idx] ?? '').trim()
    })
    out.push(obj)
  }
  return out
}
