// key: use to specify which menu unit show be highlighed.
// nameKey: key used in i18n file
// routerName: used to match loaded route
export default [
  {
    key: 'periods', nameKey: 'page.periods', url: '/periods', routerName: 'Periods', access: [0],
  },
  {
    key: 'classes', nameKey: 'page.classes', url: '/classes', routerName: 'Classes', access: [0, 1, 2],
  },
  {
    key: 'users', nameKey: 'page.users', url: '/users', routerName: 'Users', access: [0, 1],
  },
  {
    key: 'profile', nameKey: 'page.profile', url: '/profile', routerName: 'Profile', access: [0, 1, 2],
  },
];
