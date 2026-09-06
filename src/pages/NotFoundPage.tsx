import { Button, EmptyState } from '@/components'

export function NotFoundPage() {
  return (
    <main className="page">
      <EmptyState
        icon="alert"
        title="Page not found"
        description="That page doesn't exist. Head back to your shelf."
        action={
          <Button to="/" variant="secondary">
            Go home
          </Button>
        }
      />
    </main>
  )
}
