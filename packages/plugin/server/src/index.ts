import register from './register';
import bootstrap from './bootstrap';
import destroy from './destroy';
import config from './config';
import contentTypes from './content-types';
import controllers from './controllers';
import routes from './routes';
import middlewares from './middlewares';
import policies from './policies';
import services from './services';

// Explicit `any` annotation prevents TS2742 ("inferred type cannot be named
// without a reference to .pnpm/@strapi+types/…") which blocks declaration
// emission. The Strapi runtime doesn't care about this type — the shape is
// validated by Strapi's loader.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugin: any = {
  register,
  bootstrap,
  destroy,
  config,
  controllers,
  routes,
  services,
  contentTypes,
  policies,
  middlewares,
};

export default plugin;
