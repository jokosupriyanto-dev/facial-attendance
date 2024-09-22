import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Facial Attendance",
    description: "Facial attendance created with netx.js",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
