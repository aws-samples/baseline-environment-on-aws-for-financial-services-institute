import { useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { useTranslation } from 'react-i18next';
import { ConnectProvider } from './providers/ConnectProvider';
import { ApolloClientProvider } from './providers/ApolloClientProvider';
import { BotStoreProvider } from './stores/BotStore';
import { ContactStoreProvider } from './stores/ContactStore';
import { ContactDetailStoreProvider } from './stores/ContactDetailStore';
import HeaderMenuButton from '@/components/HeaderMenuButton';
import LanguageButton from '@/components/LanguageButton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
// 本プロトタイプを Custom CCP として利用する場合は、下記のコメントを外してください
// import Ccp from '@/components/Ccp';
import { twMerge } from 'tailwind-merge';
import '@aws-amplify/ui-react/styles.css';

// Cognito ユーザープール認証を利用するための設定
Amplify.configure({
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_APPSYNC_API,
      region: import.meta.env.VITE_REGION,
      defaultAuthMode: 'userPool',
    },
  },
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USERPOOL_ID,
      userPoolClientId: import.meta.env.VITE_USERPOOL_CLIENT_ID,
    },
  },
});

function App() {
  const location = useLocation();
  const { t } = useTranslation();

  const HeaderLogo = () => {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={'/'} className={twMerge('font-medium', location.pathname == '/' && 'text-primary font-bold')}>
                {t('HEADER.LOGO')}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {location.pathname == '/settings' && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="text-primary font-bold">{t('HEADER.LABEL_SETTINGS')}</BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  const Softphone = useCallback(() => {
    /* 本プロトタイプを Custom CCP として利用する場合は、下記のコメントを外してください */
    // return (
    //   <div id="ccp-container" className="h-[calc(100vh-53px)] w-96 bg-[#f2f2f2] px-4 py-2">
    //     <Ccp />
    //   </div>
    // );
    return null;
  }, []);

  return (
    <div className="flex h-full items-center justify-center">
      <Authenticator hideSignUp>
        {({ signOut, user }) => (
          <div className="size-full">
            <header className="flex items-center space-x-4 border-b px-8 py-2">
              <HeaderLogo />
              <div className="flex flex-1 justify-end gap-2">
                <LanguageButton />
                <HeaderMenuButton user={user} signOut={signOut} />
              </div>
            </header>
            <main className={twMerge('flex', location.pathname == '/settings' && 'settings')}>
              <ConnectProvider>
                <ApolloClientProvider>
                  <BotStoreProvider>
                    <ContactStoreProvider>
                      <ContactDetailStoreProvider>
                        <Softphone />
                        <Outlet />
                      </ContactDetailStoreProvider>
                    </ContactStoreProvider>
                  </BotStoreProvider>
                </ApolloClientProvider>
              </ConnectProvider>
            </main>
          </div>
        )}
      </Authenticator>
    </div>
  );
}

export default App;
