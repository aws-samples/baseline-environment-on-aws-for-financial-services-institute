import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Assign } from '@/graphql/generated';
import { Loader } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface Props {
  id: string;
  assigns: Assign[];
  loading: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

function ContactIdsCommand({ id, assigns, loading, onChange, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // const _assigns = [
  //   {
  //     contactId: 'd1452798-64aa-46d1-8cc8-f53167b5ba81',
  //     startDate: '2024-06-04T14:56:24.130Z',
  //     endDate: '2024-06-04T15:56:24.130Z',
  //   },
  // ];

  const latestAssigns = useMemo(() => assigns.slice(0, 3), [assigns]);

  // use listener on document instead of onBlur of Command
  const clickListener = (e: Event) => {
    if (e.target !== inputRef.current) {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (onChange) {
      onChange(inputText);
    }
  }, [inputText, onChange]);

  useEffect(() => {
    if (open) {
      document.addEventListener('click', clickListener);
      return () => {
        document.removeEventListener('click', clickListener);
      };
    }
  }, [open]);

  return (
    <Command id={id} shouldFilter={false} className={twMerge('z-10 overflow-visible', className)}>
      <Input
        ref={inputRef}
        className="focus-visible:ring-0 focus-visible:ring-offset-0"
        value={inputText}
        placeholder={t('MAIN_PAGE.DROPDOWN_PLACEHOLDER_CONTACT_ID')}
        onChange={(event) => {
          setInputText(event.currentTarget.value);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        // onBlur is called before onSelect of CommandItem, so it's not working as expected
        // onBlur={() => {
        //   setOpen(false);
        // }}
      />
      <div className="relative">
        {open && (
          <CommandList className="bg-background absolute left-0 top-0 w-full rounded shadow-md">
            {loading && (
              <CommandEmpty className="m-3 flex justify-center">
                <Loader className="text-muted-foreground size-4 animate-spin" />
              </CommandEmpty>
            )}
            {!loading && latestAssigns.length > 0 && (
              <CommandGroup heading={t('MAIN_PAGE.DROPDOWN_DESCRIPTION_CONTACTS', { num: latestAssigns.length })}>
                {latestAssigns?.map((assign) => (
                  <CommandItem
                    key={assign.contactId}
                    value={assign.contactId}
                    className="flex flex-col items-start gap-2"
                    onSelect={() => {
                      setInputText(assign.contactId);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1">
                      {new Date(assign.startDate).toLocaleString()}
                      {assign.endDate && ` - ${new Date(assign.endDate).toLocaleTimeString()}`}
                    </span>
                    <span className="flex-1 text-xs text-slate-600">{assign.contactId}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </div>
    </Command>
  );
}

export default ContactIdsCommand;
