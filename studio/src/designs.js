// Each design owns its preview/configuration route and export service.
// New generators register here without changing the studio navigation.
export const designs = [
  {
    id: 'window-fan',
    name: 'Window Fan Array',
    category: 'Home / Airflow',
    description: 'A made-to-measure, insulated fan system for your window opening.',
    status: 'Ready to customize',
    route: '/legacy/window-fan?embedded=1',
    engine: 'OpenSCAD',
    outputs: ['STL kit', 'Build list', 'Foam cuts', 'Configuration JSON'],
    capabilities: ['Live 3D preview', 'Configurable fit', 'Individual parts', 'ZIP export'],
    measure: 'Window opening',
  },
];
export const getDesign = (id) => designs.find((design) => design.id === id);
