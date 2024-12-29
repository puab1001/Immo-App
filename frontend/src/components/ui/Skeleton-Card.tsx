import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="w-1/4 h-5 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="mt-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </CardContent>
    </Card>
  )
}