import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HsumChaint_Node API',
      version: '1.0.0',
      description: 'API documentation for HsumChaint_Node',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', email: true, example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
          },
        },
        CreateUser: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', email: true, example: 'newuser@example.com' },
            name: { type: 'string', example: 'Alice' },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
