import { Button, EmptyState, PageHeader } from '@/components'

export function NotFoundPage() {
  return (
    <main className="page page--nav">
      <PageHeader display title="Spine" />
      <EmptyState
        icon="alert"
        title="Page not found"
        description="That page doesn't exist. Head back to your shelf."
        action={
          <Button to="/" variant="secondary" block>
            Go home
          </Button>
        }
      />
    </main>
  )
}
