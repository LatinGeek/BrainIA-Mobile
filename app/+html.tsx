import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content="Brain IA — tu inteligencia personal para conocimiento, dinero y decisiones." />
        <meta name="theme-color" content="#091315" />
        <title>Brain IA</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                background-color: #091315;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
