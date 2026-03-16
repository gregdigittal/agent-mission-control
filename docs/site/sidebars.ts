import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    'getting-started',
    'architecture',
    {
      type: 'category',
      label: 'Bridge',
      items: [
        'bridge/overview',
        'bridge/configuration',
        'bridge/production',
      ],
    },
    {
      type: 'category',
      label: 'Dashboard',
      items: [
        'dashboard/mvp',
        'dashboard/react-app',
      ],
    },
    {
      type: 'category',
      label: 'Infra',
      items: [
        'infra/tls',
      ],
    },
    {
      type: 'category',
      label: 'API',
      items: [
        'api/overview',
      ],
    },
  ],
};

export default sidebars;
