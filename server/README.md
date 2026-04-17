# KeyLogger Next.js Migration

This project replaces the original PHP server with a Next.js API route for receiving and logging data from logger.vbs.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/route.ts`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API Routes

This directory contains example API routes for the headless API app.

For more details, see [route.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route).

## API Endpoint

- POST `/api/log`
  - Body: `{ "data": "<encrypted_data>" }`
  - The endpoint decrypts the data using XOR and logs it with a timestamp and IP address to `keystrokes.log` in the project root.

## Configuration
- The encryption key must match between logger.vbs and the API route (`YourEncryptionKey`).

## Running the Project
1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```

## Notes
- The log file is written to the project root as `keystrokes.log`.
- Ensure your deployment environment allows file writing if you deploy this API.

## Hosting and Testing Locally

To host and test the Next.js server locally:

1. Open a terminal in the `logger_server` directory.
2. Install dependencies (if you haven't already):
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
4. The server will be available at `http://localhost:3000`.
5. Update the `RemoteServer` constant in `logger.vbs` to:
   ```vbs
   Const RemoteServer = "http://localhost:3000/api/log"
   ```
6. Run your logger script. It will POST data to your local Next.js API endpoint.
7. Check the `keystrokes.log` file in the project root to see the received and decrypted data.

**Note:**
- Make sure your firewall allows incoming requests to port 3000 if testing from another device.
- For production, use your deployed Vercel URL as described above.
