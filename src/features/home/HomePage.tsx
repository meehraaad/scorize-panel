import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';

export default function HomePage() {
  const { t } = useTranslation();
  const user = useUser();
  const title = user.first_name
    ? t('home.greeting', { name: user.first_name })
    : t('home.greetingNoName');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <Card className="p-6 text-text-2 lg:p-8">{t('page.comingSoon')}</Card>
    </div>
  );
}
