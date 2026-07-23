import { useRoutes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import nprogress from 'nprogress'
import 'nprogress/nprogress.css'
import { routes } from './routes'

nprogress.configure({ showSpinner: false })

export default function RouterPage() {
  const location = useLocation()
  const element = useRoutes(routes)

  useEffect(() => {
    nprogress.start()
  }, [])

  useEffect(() => {
    nprogress.done()
    return () => {
      nprogress.start()
    }
  }, [location])

  return <>{element}</>
}
