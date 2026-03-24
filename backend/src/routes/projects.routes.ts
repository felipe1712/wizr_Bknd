import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/projects.controller';

const router = Router();

// Todos los endpoints de proyectos requieren autenticación
router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
