# HRMS Backend Deployment Guide for Render

## 🚀 Deploy to Render

### Step 1: Prepare Your Repository
1. Push your code to GitHub/GitLab
2. Make sure all files are committed

### Step 2: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your repository

### Step 3: Deploy Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:

**Basic Settings:**
- **Name**: `hrms-backend`
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)

**Build & Deploy:**
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 4: Environment Variables
Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hrms
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=30d
CORS_ORIGIN=https://your-frontend-domain.com
```

### Step 5: Database Setup
**Option A: MongoDB Atlas (Recommended)**
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free cluster
3. Get connection string
4. Add to MONGODB_URI environment variable

**Option B: Render Database**
1. In Render dashboard, create "PostgreSQL" database
2. Update your code to use PostgreSQL instead of MongoDB

### Step 6: Deploy
1. Click "Deploy" in Render dashboard
2. Wait for deployment to complete
3. Your API will be available at: `https://your-app-name.onrender.com`

## 🔧 Production Optimizations

### Update package.json scripts:
```json
{
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "build": "echo 'No build step required'"
  }
}
```

### Update CORS settings in app.js:
```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://your-frontend-domain.com',
  credentials: true
}));
```

## 📋 Post-Deployment Checklist

- [ ] API is accessible at your Render URL
- [ ] Health check endpoint works: `/health`
- [ ] Database connection is working
- [ ] Environment variables are set
- [ ] CORS is configured for your frontend domain

## 🚨 Important Notes

1. **Free Tier Limitations**: Render free tier has sleep mode after 15 minutes of inactivity
2. **Database**: Use MongoDB Atlas for production (free tier available)
3. **Environment Variables**: Never commit sensitive data to repository
4. **CORS**: Update CORS_ORIGIN to your actual frontend domain

## 🔗 Useful Links

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas](https://mongodb.com/atlas)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
