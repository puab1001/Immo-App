import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorCard({ 
  title = "Ein Fehler ist aufgetreten",
  message = "Beim Laden der Daten ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
  onRetry 
}: ErrorStateProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="space-y-2">
            <h3 className="font-semibold text-xl">{title}</h3>
            <p className="text-muted-foreground">{message}</p>
          </div>
          {onRetry && (
            <Button onClick={onRetry} className="mt-4">
              Erneut versuchen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}