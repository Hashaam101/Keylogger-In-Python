export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "black", color: "white", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}