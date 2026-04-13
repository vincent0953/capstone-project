import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function TestSimple() {
  const [message, setMessage] = useState('Testing...')
  const [details, setDetails] = useState('')

  useEffect(() => {
    async function test() {
      try {
        setDetails('Checking environment variables...')

        const url = import.meta.env.VITE_SUPABASE_URL
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY

        // check env
        if (!url) {
          setMessage('❌ Missing VITE_SUPABASE_URL in .env')
          setDetails('Please check your .env file')
          return
        }

        if (!key) {
          setMessage('❌ Missing VITE_SUPABASE_ANON_KEY in .env')
          setDetails('Please check your .env file')
          return
        }

        setDetails(`URL: ${url}\nTrying to connect...`)

        // Supabase test query (NO TS ERROR VERSION)
        const { error } = await supabase
          .from('users')
          .select('*')
          .limit(1)

        if (error) {
          setMessage(`❌ Supabase Error: ${error.message}`)
          setDetails(
            `Error code: ${error.code}\nHint: Check Supabase table or CORS settings`
          )
        } else {
          setMessage('✅ Connected to Supabase successfully!')
          setDetails('Your connection is working!')
        }
      } catch (err: any) {
        setMessage(`❌ Failed: ${err.message}`)
        setDetails(
          'Possible issue: CORS or Supabase config.\nAdd http://localhost:5173 to Allowed Origins'
        )
      }
    }

    test()
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '600px' }}>
      <h1>🔌 Supabase Connection Test</h1>

      <div
        style={{
          padding: '20px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          borderRadius: '8px',
          margin: '20px 0',
        }}
      >
        <p style={{ fontSize: '18px', margin: 0 }}>{message}</p>
      </div>

      <pre
        style={{
          backgroundColor: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px',
          overflow: 'auto',
          fontSize: '12px',
        }}
      >
        {details}
      </pre>

      <h3>Quick Fix:</h3>
      <ol>
        <li>Go to Supabase Dashboard → Settings → API</li>
        <li>Scroll to "Allowed Origins"</li>
        <li>Add: <code>http://localhost:5173</code></li>
        <li>Restart your dev server</li>
      </ol>
    </div>
  )
}