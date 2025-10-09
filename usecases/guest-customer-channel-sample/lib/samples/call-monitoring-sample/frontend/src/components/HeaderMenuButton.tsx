import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthUser, fetchUserAttributes } from 'aws-amplify/auth';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
interface Props {
  user?: AuthUser;
  signOut?: () => void;
}

function HeaderMenuButton({ user, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string>('');

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      fetchUserAttributes().then((data) => {
        setEmail(data.email ?? '');
      });
    }
  }, [user]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button aria-expanded={open} role="combobox" className="size-8 rounded-full bg-slate-300 font-semibold">
          <span className="relative flex shrink-0 overflow-hidden rounded-full text-lg">
            {user?.signInDetails?.loginId![0].toUpperCase()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              <div className="px-2 py-1.5 text-sm font-normal">
                <div className="flex flex-col space-y-2">{email}</div>
              </div>
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  navigate(location.pathname === '/' ? '/settings' : '/');
                  setOpen(false);
                }}
              >
                {location.pathname === '/' ? t('HEADER.LABEL_SETTINGS') : t('HEADER.LABEL_HOME')}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  if (signOut) {
                    signOut();
                    setOpen(false);
                  }
                }}
              >
                {t('HEADER.LABEL_SIGN_OUT')}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default HeaderMenuButton;
