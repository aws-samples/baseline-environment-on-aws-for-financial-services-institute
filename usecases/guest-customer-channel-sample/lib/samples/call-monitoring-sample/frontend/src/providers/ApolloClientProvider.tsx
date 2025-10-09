import React, { ReactNode, createContext, useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, NormalizedCacheObject } from '@apollo/client';
import { AUTH_TYPE, AuthOptions, createAuthLink } from 'aws-appsync-auth-link';
import { createSubscriptionHandshakeLink } from 'aws-appsync-subscription-link';

interface ProviderProps {
  children: ReactNode;
}

const ApolloClientContext = createContext({});

const ApolloClientProvider: React.FC<ProviderProps> = ({ children }) => {
  const [client, setClient] = useState<ApolloClient<NormalizedCacheObject>>();

  useEffect(() => {
    // AppSync API を呼ぶための Apollo Client を作成
    const config = {
      region: import.meta.env.VITE_REGION,
      auth: {
        type: AUTH_TYPE.AMAZON_COGNITO_USER_POOLS,
        jwtToken: async () => {
          const currentSession = await fetchAuthSession();
          return currentSession.tokens?.idToken?.toString() ?? '';
        },
      } satisfies AuthOptions,
    };

    const link = ApolloLink.from([
      createAuthLink({
        ...config,
        url: import.meta.env.VITE_APPSYNC_API,
      }),
      createSubscriptionHandshakeLink({
        ...config,
        url: import.meta.env.VITE_APPSYNC_API,
      }),
    ]);

    const apolloClient = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    setClient(apolloClient);
  }, []);

  if (!client) {
    return null;
  }

  return (
    <ApolloClientContext.Provider value={{}}>
      <ApolloProvider client={client}>{children}</ApolloProvider>
    </ApolloClientContext.Provider>
  );
};

export { ApolloClientContext, ApolloClientProvider };
