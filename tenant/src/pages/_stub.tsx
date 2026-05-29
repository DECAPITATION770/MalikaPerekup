import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Placeholder rendered for every page that hasn't been ported yet during
 * the Phase 3 rebuild. Lets users navigate, see the layout, and exercise
 * the auth/Sidebar/BottomNav while individual pages are still being
 * rewritten one at a time.
 */
export function StubPage({ name, hint }: { name: string; hint?: string }) {
  const { t } = useTranslation();
  return (
    <Card className="max-w-xl mx-auto animate-fade-up">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{name}</CardTitle>
          <Badge variant="accent">rebuild</Badge>
        </div>
        <CardDescription>{hint ?? t('common.soon')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body text-text-dim leading-relaxed">{t('common.soon_body')}</p>
      </CardContent>
    </Card>
  );
}
