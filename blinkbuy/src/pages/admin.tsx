import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Users, Briefcase, ShoppingBag, Star, Shield, CheckCircle, Award, Trash2, Eye, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin, formatMK } from "@/lib/auth";

type Tab = "overview" | "users" | "services" | "reports";

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isAdmin(user)) { setLocation("/"); return; }
    loadData();
  }, [user, tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === "overview") {
        const data = await api.get("/admin/stats");
        setStats(data);
      } else if (tab === "users") {
        const data = await api.get("/admin/users?limit=50");
        setUsers(data.users || []);
      } else if (tab === "services") {
        const data = await api.get("/services?limit=50");
        setServices(data.services || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const verifyUser = async (userId: string, isVerified: boolean) => {
    try {
      await api.put(`/admin/users/${userId}`, { isVerified });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified } : u));
    } catch (e) {}
  };

  const featureService = async (serviceId: string, isFeatured: boolean) => {
    try {
      await api.put(`/admin/services/${serviceId}`, { isFeatured });
      setServices(prev => prev.map(s => s.id === serviceId ? { ...s, isFeatured } : s));
    } catch (e) {}
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {}
  };

  if (!user || !isAdmin(user)) return null;

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "services", label: "Services", icon: Briefcase },
    { id: "reports", label: "Reports", icon: Shield },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={20} className="text-primary" />
            <h1 className="text-2xl font-black">Admin Panel</h1>
          </div>
          <p className="text-muted-foreground text-sm">BlinkBuy platform management</p>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <div className="font-semibold">{user.name}</div>
          <div>Administrator</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      ) : (
        <>
          {/* Overview */}
          {tab === "overview" && stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers || 0, icon: Users, color: "text-blue-600" },
                  { label: "Total Services", value: stats.totalServices || 0, icon: Briefcase, color: "text-green-600" },
                  { label: "Total Jobs", value: stats.totalJobs || 0, icon: Briefcase, color: "text-purple-600" },
                  { label: "Total Revenue", value: formatMK(stats.totalRevenue || 0), icon: TrendingUp, color: "text-amber-600" },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-card-border rounded-xl p-4">
                    <s.icon size={18} className={`${s.color} mb-2`} />
                    <div className="text-2xl font-black">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5">
                <h2 className="font-bold mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => setTab("users")} className="p-3 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-all">Manage Users</button>
                  <button onClick={() => setTab("services")} className="p-3 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-all">Feature Services</button>
                  <Link href="/post-service" className="p-3 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-all text-center">Add Service</Link>
                  <Link href="/post-job" className="p-3 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-all text-center">Post Job</Link>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-2">Payment Instructions</h3>
                <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <p>To feature a worker: collect MK 5,000 via Airtel Money (0999626944) or TNM Mpamba (0888712272)</p>
                  <p>To verify a worker: collect MK 10,000 via same numbers</p>
                  <p>After payment confirmation, use the "Users" tab to mark them as verified/featured</p>
                </div>
              </div>
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-bold">All Users ({users.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Role</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Location</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-muted/50 transition-all">
                        <td className="px-4 py-3">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full capitalize">{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.location}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {u.isVerified && <span className="flex items-center gap-0.5 text-xs text-primary"><CheckCircle size={11} /> Verified</span>}
                            {u.isTrusted && <span className="flex items-center gap-0.5 text-xs text-amber-600"><Award size={11} /> Trusted</span>}
                            {!u.isVerified && !u.isTrusted && <span className="text-xs text-muted-foreground">Standard</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${u.id}`} className="p-1 hover:bg-muted rounded transition-all">
                              <Eye size={14} className="text-muted-foreground" />
                            </Link>
                            <button
                              onClick={() => verifyUser(u.id, !u.isVerified)}
                              className={`p-1 rounded transition-all ${u.isVerified ? "hover:bg-red-100 text-red-500" : "hover:bg-green-100 text-green-600"}`}
                              title={u.isVerified ? "Remove verification" : "Verify user"}
                            >
                              <CheckCircle size={14} />
                            </button>
                            {u.email !== "otechy8@gmail.com" && (
                              <button onClick={() => deleteUser(u.id)} className="p-1 hover:bg-red-100 text-red-500 rounded transition-all">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Services */}
          {tab === "services" && (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-bold">All Services ({services.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Category</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Price</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {services.map(s => (
                      <tr key={s.id} className="hover:bg-muted/50 transition-all">
                        <td className="px-4 py-3">
                          <div className="font-medium max-w-48 truncate">{s.title}</div>
                          <div className="text-xs text-muted-foreground">{s.location}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.category}</td>
                        <td className="px-4 py-3 font-semibold text-primary">{s.priceDisplay || formatMK(s.price)}</td>
                        <td className="px-4 py-3">
                          {s.isFeatured && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">Featured</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/services/${s.id}`} className="p-1 hover:bg-muted rounded transition-all">
                              <Eye size={14} className="text-muted-foreground" />
                            </Link>
                            <button
                              onClick={() => featureService(s.id, !s.isFeatured)}
                              className={`text-xs px-2 py-1 rounded transition-all ${s.isFeatured ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-muted hover:bg-amber-100 text-muted-foreground hover:text-amber-700"}`}
                            >
                              {s.isFeatured ? "Unfeature" : "Feature"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports */}
          {tab === "reports" && (
            <div className="bg-card border border-card-border rounded-xl p-6 text-center">
              <Shield size={48} className="text-muted-foreground mx-auto mb-3 opacity-30" />
              <h3 className="font-bold mb-1">User Reports</h3>
              <p className="text-muted-foreground text-sm">User reports and moderation queue will appear here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
