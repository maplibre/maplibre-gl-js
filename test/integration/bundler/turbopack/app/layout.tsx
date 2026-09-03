import type {ReactNode} from 'react';

export const metadata = {
    title: 'MapLibre GL JS: Next.js example'
};

export default function RootLayout({children}: {children: ReactNode}) {
    return (
        <html lang="en">
            <body style={{margin: 0}}>{children}</body>
        </html>
    );
}
