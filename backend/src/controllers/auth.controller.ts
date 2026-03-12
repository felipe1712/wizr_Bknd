import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-wizr-key-2026';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and profile in a transaction
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        profile: {
          create: {
            full_name
          }
        },
        roles: {
          create: {
            role: 'analista' // Default role
          }
        }
      },
      include: {
        profile: true,
        roles: true
      }
    });

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.profile?.full_name,
        roles: user.roles.map(r => r.role)
      },
      token
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, roles: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare passwords
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.profile?.full_name,
        roles: user.roles.map(r => r.role)
      },
      token
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: Request | any, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, roles: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.profile?.full_name,
      avatar_url: user.profile?.avatar_url,
      roles: user.roles.map(r => r.role)
    });
  } catch (error) {
    console.error('GetMe Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const recoverPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    // In a real application, you would generate a secure token here,
    // save it to the database with an expiration time,
    // and send an email using a service like SendGrid, AWS SES, or Resend.
    console.log(`Password recovery requested for: ${email}`);
    
    // For now, we just simulate success to complete the UI flow
    res.json({ message: 'Recovery email sent (simulated)' });
  } catch (error) {
    console.error('Recover Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { password, token } = req.body;
    // Here we would normally verify the token.
    // Since we don't have a real token system yet, we'll just mock it.
    console.log(`Password reset requested with token: ${token}`);
    
    // As a mock, let's just assume success.
    res.json({ message: 'Password reset successfully (simulated)' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestAccess = async (req: Request, res: Response) => {
  try {
    const { email, full_name, reason } = req.body;
    
    // Check if a request already exists
    const existingReq = await prisma.accessRequest.findUnique({
      where: { email }
    });
    
    if (existingReq) {
      return res.status(409).json({ error: 'Access request already exists' });
    }
    
    await prisma.accessRequest.create({
      data: {
        email,
        full_name,
        reason
      }
    });

    res.status(201).json({ message: 'Access request created successfully' });
  } catch (error) {
    console.error('Request Access Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
