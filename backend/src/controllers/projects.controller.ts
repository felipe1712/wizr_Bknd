import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';

// GET /api/projects
export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const projects = await prisma.project.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    return res.status(200).json(projects);
  } catch (error: any) {
    console.error('Error al obtener proyectos:', error);
    return res.status(500).json({ error: 'Error del servidor.', details: error.message });
  }
};

// GET /api/projects/:id
export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'No autorizado.' });

    const project = await prisma.project.findFirst({
      where: { id: String(id), user_id: userId }
    });

    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    return res.status(200).json(project);
  } catch (error: any) {
    console.error('Error al obtener proyecto:', error);
    return res.status(500).json({ error: 'Error del servidor.', details: error.message });
  }
};

// POST /api/projects
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autorizado.' });

    const {
      nombre,
      descripcion,
      tipo,
      objetivo,
      audiencia,
      sensibilidad,
      alcance_temporal,
      alcance_geografico
    } = req.body;

    const newProject = await prisma.project.create({
      data: {
        user_id: userId,
        nombre,
        descripcion,
        tipo,
        objetivo,
        audiencia,
        sensibilidad,
        alcance_temporal,
        alcance_geografico: alcance_geografico || []
      }
    });

    return res.status(201).json(newProject);
  } catch (error: any) {
    console.error('Error al crear proyecto:', error);
    return res.status(500).json({ error: 'Error del servidor.', details: error.message });
  }
};

// PATCH /api/projects/:id
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'No autorizado.' });

    const existingProject = await prisma.project.findFirst({
      where: { id: String(id), user_id: userId }
    });

    if (!existingProject) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    const updatedProject = await prisma.project.update({
      where: { id: String(id) },
      data: req.body
    });

    return res.status(200).json(updatedProject);
  } catch (error: any) {
    console.error('Error al actualizar proyecto:', error);
    return res.status(500).json({ error: 'Error del servidor.', details: error.message });
  }
};

// DELETE /api/projects/:id
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'No autorizado.' });

    const existingProject = await prisma.project.findFirst({
      where: { id: String(id), user_id: userId }
    });

    if (!existingProject) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    await prisma.project.delete({
      where: { id: String(id) }
    });

    return res.status(200).json({ success: true, message: 'Proyecto eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar proyecto:', error);
    return res.status(500).json({ error: 'Error del servidor.', details: error.message });
  }
};
