<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Calcus - Pricing Intelligence Platform

A full-stack application for cloud pricing intelligence and cost optimization.

## Project Structure

This is a monorepo with separated backend and frontend:

```
calcus/
├── backend/           # Node.js/Express backend server
│   ├── server.ts      # Main server file
│   ├── package.json   # Backend dependencies
│   ├── tsconfig.json  # Backend TypeScript config
│   ├── requirements.txt # Python dependencies
│   └── ...            # Other backend files
├── frontend/          # React frontend
│   ├── src/           # React source code
│   ├── package.json   # Frontend dependencies
│   ├── vite.config.ts # Vite configuration
│   └── ...            # Other frontend files
├── package.json       # Root workspace configuration
└── README.md          # This file
```

## Run Locally

**Prerequisites:** Node.js 18+, Python 3.8+

### Setup

1. Install root dependencies:
   ```bash
   npm install
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

4. Set environment variables in `backend/.env` (see Database and AWS setup below)

### Development

Start the backend server:
```bash
cd backend
npm run dev
```

In another terminal, start the frontend:
```bash
cd frontend
npm run dev
```

Or use the root scripts:
```bash
npm run dev:backend  # Start backend
npm run dev:frontend # Start frontend
```

### Building for Production

Build both frontend and backend:
```bash
npm run build
```

Build individually:
```bash
cd backend && npm run build
cd frontend && npm run build
```

Start production server:
```bash
cd backend
npm start
```

## Database and AWS setup

Create `backend/.env` in backend directory:

```env
DATABASE_URL=mysql://root:YOUR_DB_PASSWORD@localhost:3306/calcus_db
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1
JWT_SECRET_KEY=change-this-secret
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

## IAM policy baseline (least privilege)

Start with only read permissions required by current APIs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "pricing:GetProducts"
      ],
      "Resource": "*"
    }
  ]
}
```

## MariaDB backup command

```bash
mysqldump -u root -p calcus_db > backup_calcus_db.sql
```
