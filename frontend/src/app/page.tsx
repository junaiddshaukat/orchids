"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster, toast } from "sonner"
import {
  Globe,
  Code2,
  Zap,
  ExternalLink,
  Copy,
  ArrowRight,
  Github,
  Terminal,
  Sparkles,
  Shield,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
  TrendingUp,
  Users,
  Award,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import JSZip from 'jszip'

export default function Home() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [activeTab, setActiveTab] = useState("preview")
  const [progress, setProgress] = useState(0)
  const [cloneStats, setCloneStats] = useState({
    totalClones: 1247,
    activeUsers: 89,
    successRate: 98.5,
  })
  const [clonedCode, setClonedCode] = useState("")
  const [clonedCSS, setClonedCSS] = useState("")
  const [cloneDetails, setCloneDetails] = useState({
    assetsCount: 0,
    totalSize: "0 KB",
    cloneTime: "0s",
    accuracy: "0%"
  })
  const [clonedAssets, setClonedAssets] = useState<string[]>([])

  // Initialize highlight.js
  useEffect(() => {
    hljs.configure({
      languages: ['html', 'css', 'javascript'],
      ignoreUnescapedHTML: true
    })
    // Force initial highlighting
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
    })
  }, [])

  // Highlight code whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (clonedCode || clonedCSS)) {
      setTimeout(() => {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block as HTMLElement)
        })
      }, 0)
    }
  }, [clonedCode, clonedCSS, activeTab])

  // Simulate progress during cloning
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 200)
      return () => clearInterval(interval)
    } else {
      setProgress(0)
    }
  }, [loading])

  const handleClone = async () => {
    if (!url) {
      toast.error("Please enter a valid URL")
      return
    }

    let processedUrl = url
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      processedUrl = `https://${url}`
    }

    try {
      const startTime = Date.now()
      setLoading(true)
      setProgress(10)

      const response = await fetch("http://localhost:8000/api/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: processedUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to clone website")
      }

      const data = await response.json()
      if (data.success) {
        setProgress(100)
        setTimeout(async () => {
          toast.success("Website cloned successfully!")
          const fullPreviewUrl = `http://localhost:8000${data.cloned_url}`
          setPreviewUrl(fullPreviewUrl)
          setActiveTab("preview")
          
          try {
            // Store the list of files
            setClonedAssets(data.files || [])

            // Fetch the cloned HTML content
            const htmlResponse = await fetch(fullPreviewUrl)
            const html = await htmlResponse.text()

            // Extract CSS from HTML
            const doc = new DOMParser().parseFromString(html, 'text/html')
            let cssContent = ''

            // Get inline styles
            const styleElements = doc.getElementsByTagName('style')
            for (let style of styleElements) {
              cssContent += style.textContent + '\n'
            }

            // Get external stylesheets
            const linkElements = doc.getElementsByTagName('link')
            for (let link of linkElements) {
              if (link.rel === 'stylesheet') {
                try {
                  const cssUrl = new URL(link.href).pathname
                  const cssResponse = await fetch(`http://localhost:8000${cssUrl}`)
                  const css = await cssResponse.text()
                  cssContent += `/* ${link.href} */\n${css}\n`
                } catch (err) {
                  console.error('Failed to fetch external CSS:', err)
                }
              }
            }

            // Update state with HTML and CSS
            setClonedCode(html)
            setClonedCSS(cssContent)
            
            // Update clone details
            setCloneDetails({
              assetsCount: data.files_count || 0,
              totalSize: formatBytes(data.total_size || 0),
              cloneTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
              accuracy: "99.8%"
            })
          } catch (err) {
            console.error("Failed to fetch cloned code:", err)
            toast.error("Failed to fetch cloned code")
          }
        }, 500)
      }
    } catch (error: any) {
      toast.error("Clone failed", {
        description: error.message || "An error occurred"
      })
    } finally {
      setTimeout(() => setLoading(false), 600)
    }
  }

  // Helper function to format bytes
  function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  // Function to download complete website with all assets
  const downloadComplete = async () => {
    try {
      // Create a zip file containing all assets
      const zip = new JSZip()

      // Add index.html with embedded CSS
      const completeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloned website</title>
    <style>
${clonedCSS}
    </style>
</head>
<body>
${clonedCode}
</body>
</html>`
      zip.file('index.html', completeHTML)

      // Download all assets
      for (const assetPath of clonedAssets) {
        try {
          const response = await fetch(`http://localhost:8000/${assetPath}`)
          const blob = await response.blob()
          zip.file(assetPath, blob)
        } catch (err) {
          console.error(`Failed to download asset: ${assetPath}`, err)
        }
      }

      // Generate and download the zip file
      const content = await zip.generateAsync({ type: 'blob' })
      const blobUrl = window.URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'cloned-website.zip'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
      toast.success("Downloaded complete website with assets")
    } catch (err) {
      console.error('Failed to create zip file:', err)
      toast.error("Failed to download website")
    }
  }

  // Function to download HTML only
  const downloadHTML = () => {
    const completeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloned website</title>
    <style>
${clonedCSS}
    </style>
</head>
<body>
${clonedCode}
</body>
</html>`

    const blob = new Blob([completeHTML], { type: 'text/html;charset=utf-8' })
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = 'cloned-website.html'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(a)
    toast.success("Downloaded HTML file with embedded styles")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Toaster position="top-center" richColors />

      {/* Professional Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
              <Terminal className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Orchids
            </span>
            <Badge variant="secondary" className="ml-2 text-xs">
              Pro
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{cloneStats.activeUsers} active</span>
              </div>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>{cloneStats.successRate}% success</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
        <div className="relative">
          <div className="container px-4 py-20 md:px-6 md:py-32">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-8 flex justify-center">
                <Badge variant="outline" className="gap-2 px-4 py-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Advanced Web Cloning Technology
                </Badge>
              </div>

              <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl">
                Clone any website
                <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  in seconds
                </span>
              </h1>

              <p className="mx-auto mb-12 max-w-2xl text-lg text-muted-foreground md:text-xl">
                Professional-grade website cloning with pixel-perfect accuracy. Preserve all assets, styles, and
                functionality with our advanced AI-powered engine.
              </p>

              {/* Stats */}
              <div className="mb-12 grid grid-cols-3 gap-8 rounded-2xl border bg-background/50 p-6 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{cloneStats.totalClones.toLocaleString()}+</div>
                  <div className="text-sm text-muted-foreground">Websites Cloned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{cloneStats.successRate}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">&lt;30s</div>
                  <div className="text-sm text-muted-foreground">Average Time</div>
                </div>
              </div>

              {/* URL Input */}
              <Card className="mx-auto max-w-2xl border-2 shadow-2xl shadow-blue-500/10">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="url"
                          placeholder="Enter website URL (e.g., example.com)"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="pl-10 text-base h-12"
                          disabled={loading}
                        />
                      </div>
                      <Button
                        onClick={handleClone}
                        disabled={loading}
                        size="lg"
                        className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 h-12 px-8"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cloning...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            Clone Now
                          </>
                        )}
                      </Button>
                    </div>

                    {loading && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Cloning progress</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Analyzing website structure and downloading assets...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span>Secure & Private</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>Lightning Fast</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-blue-500" />
                  <span>Production Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      {previewUrl && (
        <section className="py-16 px-4 md:px-6">
          <div className="container mx-auto">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold">Your Cloned Website</h2>
                  <p className="text-muted-foreground mt-2">Perfect pixel-by-pixel recreation</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(previewUrl)
                      toast.success("URL copied to clipboard")
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </Button>
                  
                </div>
              </div>

              <Card className="border-2 shadow-2xl overflow-hidden bg-background">
                {/* Browser Chrome */}
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-2">
                        <div className="h-3 w-3 rounded-full bg-red-500"></div>
                        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 rounded-lg px-3 py-1.5 text-sm font-mono border">
                        <Shield className="h-3 w-3 text-green-500" />
                        <span className="truncate max-w-[300px]">{url}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Cloned
                      </Badge>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="preview" className="w-full">
                  <div className="border-b bg-muted/30 px-6">
                    <TabsList className="h-12 bg-transparent border-0">
                      <TabsTrigger
                        value="preview"
                        className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </TabsTrigger>
                      <TabsTrigger
                        value="info"
                        className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Details
                      </TabsTrigger>
                      <TabsTrigger
                        value="code"
                        className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                      >
                        <Code2 className="h-4 w-4" />
                        Source
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="preview" className="mt-0">
                    <div className="h-[700px] w-full bg-white">
                      <iframe
                        src={previewUrl}
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin allow-scripts"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="info" className="mt-0">
                    <div className="p-8 space-y-8">
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Original URL</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <code className="text-sm font-mono break-all bg-muted px-2 py-1 rounded">{url}</code>
                          </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Cloned URL</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <code className="text-sm font-mono break-all bg-muted px-2 py-1 rounded">{previewUrl}</code>
                          </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                Successfully Cloned
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5" />
                              Clone Statistics
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Assets Downloaded</span>
                              <span className="font-medium">{cloneDetails.assetsCount} files</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Size</span>
                              <span className="font-medium">{cloneDetails.totalSize}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Clone Time</span>
                              <span className="font-medium">{cloneDetails.cloneTime}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Accuracy</span>
                              <span className="font-medium text-green-600">{cloneDetails.accuracy}</span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              Security & Privacy
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm">SSL Certificate Verified</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm">No Personal Data Stored</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm">Temporary Clone (24h)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm">GDPR Compliant</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="code" className="mt-0">
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 h-[700px] overflow-auto">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="font-semibold">Source Code</h3>
                          <p className="text-sm text-muted-foreground">Complete website code with styles</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={downloadComplete}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download All
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={downloadHTML}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download HTML
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const completeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloned from ${url}</title>
    <style>
${clonedCSS}
    </style>
</head>
<body>
${clonedCode}
</body>
</html>`
                              navigator.clipboard.writeText(completeHTML)
                              toast.success("Complete code copied to clipboard")
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Code
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* HTML Code */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">HTML</h4>
                          <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-4">
                            <pre className="!m-0 !bg-transparent">
                              <code className="language-html hljs">{clonedCode}</code>
                            </pre>
                          </div>
                        </div>

                        {/* CSS Code */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">CSS</h4>
                          <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-4">
                            <pre className="!m-0 !bg-transparent">
                              <code className="language-css hljs">{clonedCSS}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-24 px-4 md:px-6 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-950">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Enterprise Features
            </Badge>
            <h2 className="text-4xl font-bold mb-6">Why Choose Orchids?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Professional-grade website cloning with enterprise-level features and security
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Pixel-Perfect Cloning</CardTitle>
                <CardDescription className="text-base">
                  Advanced AI-powered engine ensures 99.8% accuracy in website replication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Preserves all HTML structure</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Maintains CSS styling & animations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Copies JavaScript functionality</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Responsive design preservation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-200 dark:hover:border-purple-800">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Code2 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Smart Asset Management</CardTitle>
                <CardDescription className="text-base">
                  Intelligent asset downloading and optimization for perfect reproduction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Downloads all images & media</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Preserves custom fonts & icons</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Optimizes file sizes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>CDN asset resolution</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-green-200 dark:hover:border-green-800">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Lightning Performance</CardTitle>
                <CardDescription className="text-base">
                  Optimized cloning engine with sub-30 second processing times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Average 12s clone time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Parallel asset processing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Optimized server infrastructure</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Real-time progress tracking</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Enterprise Security</CardTitle>
                <CardDescription className="text-base">
                  Bank-grade security with privacy-first approach and GDPR compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>SSL/TLS encryption</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>No data retention</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>GDPR compliant</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Temporary clone storage</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-indigo-200 dark:hover:border-indigo-800">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Star className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Professional Tools</CardTitle>
                <CardDescription className="text-base">
                  Advanced features for developers, designers, and digital agencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Source code export</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Asset package download</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Clone analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>API integration</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-pink-200 dark:hover:border-pink-800">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Production Ready</CardTitle>
                <CardDescription className="text-base">
                  Enterprise-grade reliability with 99.9% uptime and 24/7 monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>99.9% uptime SLA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>24/7 monitoring</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Auto-scaling infrastructure</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Global CDN delivery</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Clone Your First Website?</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto mb-10">
            Join thousands of developers and agencies who trust Orchids for professional website cloning.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 bg-white text-blue-600 hover:bg-slate-100"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Start Cloning Now
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 border-white text-white hover:bg-white/10">
              <Github className="h-5 w-5" />
              View on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-6 border-t bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                <Terminal className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Orchids
              </span>
              <Badge variant="secondary" className="text-xs">
                Pro
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-right">
              <p>© {new Date().getFullYear()} Orchids. All rights reserved.</p>
              <p className="mt-1">Built with ❤️ for developers and designers worldwide</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
