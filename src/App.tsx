import { useState } from 'react'
import axios from 'axios'
import './App.css'
import { ConfigForm } from './components/ConfigForm'
import { IssuesByUserDisplay, ProductionIssueTable } from './components/IssueTable'
import gitlabService from './services/gitlabService'
import type { GitLabConfig, IssuesByUser, GitLabIssue } from './types/gitlab'

function App() {
  const [issuesByUser, setIssuesByUser] = useState<IssuesByUser[]>([])
  const [productionIssues, setProductionIssues] = useState<GitLabIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)

  const handleConfigSubmit = async (config: GitLabConfig) => {
    setLoading(true)
    setError(null)
    
    try {
      gitlabService.setConfig(config)
      const { regularIssues, productionIssues: prodIssues } = await gitlabService.getOpenIssuesByProjects()
      setIssuesByUser(regularIssues)
      setProductionIssues(prodIssues)
      setIsConfigured(true)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const refreshedToken = window.prompt('Your GitLab token has expired. Enter a new token to continue:')
        if (refreshedToken && refreshedToken.trim()) {
          const retriedConfig: GitLabConfig = {
            ...config,
            personalAccessToken: refreshedToken.trim(),
          }

          localStorage.setItem('gitlab_personal_access_token', refreshedToken.trim())

          try {
            gitlabService.setConfig(retriedConfig)
            const { regularIssues, productionIssues: prodIssues } = await gitlabService.getOpenIssuesByProjects()
            setIssuesByUser(regularIssues)
            setProductionIssues(prodIssues)
            setIsConfigured(true)
            setError(null)
            return
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : 'Failed to fetch issues after token refresh')
            setIsConfigured(false)
            return
          }
        }

        localStorage.removeItem('gitlab_personal_access_token')
        setError('GitLab token expired. Enter a new token to continue.')
        setIsConfigured(false)
        return
      }

      setError(err instanceof Error ? err.message : 'Failed to fetch issues')
      setIsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>GitLab Issues Dashboard</h1>
        <p>Monitor open issues across your GitLab projects</p>
      </header>

      <main className="app-content">
        <ConfigForm onConfigSubmit={handleConfigSubmit} loading={loading} />

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isConfigured && !loading && (
          <>
            <div className="dashboard-section production-section">
              <h2>🚨 Production Issues Without Error Type Core Issues ({productionIssues.length})</h2>
              <ProductionIssueTable issues={productionIssues} />
            </div>
            
            <div className="dashboard-section">
              <h2>Open Issues by User</h2>
              <IssuesByUserDisplay issuesByUser={issuesByUser} />
            </div>
          </>
        )}

        {loading && (
          <div className="loading-message">
            Loading issues...
          </div>
        )}
      </main>
    </div>
  )
}

export default App
