import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmationButtonProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  onSubmit: () => void;
  description?: string;
}

export default function ConfirmationButton(props: ConfirmationButtonProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={props.variant ?? 'default'} type="button">
          {props.children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmation</AlertDialogTitle>
          <AlertDialogDescription>{props.description ?? 'Are you sure you want to continue?'}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('COMMON.BUTTON_CANCEL')}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={props.onSubmit}>{t('COMMON.BUTTON_OK')}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
