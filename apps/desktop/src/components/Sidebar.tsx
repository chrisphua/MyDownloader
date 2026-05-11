export type Page = "todos";

interface NavItem {
  id: Page;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "todos", label: "Todos", icon: "✓" },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
}

export function Sidebar({ activePage, onNavigate, onSignOut }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">◈</span>
        <span className="sidebar-brand-name">Todo App</span>
      </div>

      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-item${activePage === item.id ? " nav-item--active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <button className="nav-signout" onClick={onSignOut}>
          <span className="nav-item-icon">⎋</span>
          <span className="nav-item-label">Sign out</span>
        </button>
      </div>
    </nav>
  );
}
