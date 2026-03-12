import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdminUser() {
  const email = 'admin@wizr.kimedia.mx'; // Puedes cambiar esto por tu correo real
  const password = 'AdminPassword123!'; // Cambia esto por una contraseña segura
  const fullName = 'Administrador Global';

  try {
    console.log(`Verificando si el usuario ${email} ya existe...`);
    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('El usuario administrador ya existe en la base de datos.');
      
      // Asegurarnos de que tiene el rol de admin por si acaso
      const hasAdminRole = await prisma.userRole.findUnique({
        where: {
          user_id_role: { user_id: existingAdmin.id, role: 'admin' }
        }
      });

      if (!hasAdminRole) {
          console.log('Añadiendo rol "admin" al usuario existente...');
          await prisma.userRole.create({
              data: { user_id: existingAdmin.id, role: 'admin' }
          });
      }
      return;
    }

    console.log('Creando usuario administrador...');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        profile: {
          create: {
            full_name: fullName
          }
        },
        roles: {
          create: {
            role: 'admin'
          }
        }
      }
    });

    console.log('\n✅ Usuario administrador creado con éxito:');
    console.log(`Correo: ${email}`);
    console.log(`Contraseña: ${password}`);
    console.log('¡Usa estas credenciales para iniciar sesión directamente!\n');

  } catch (error) {
    console.error('Error al crear el administrador:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
