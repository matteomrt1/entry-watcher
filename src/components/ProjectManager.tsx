import { useState } from 'react';
import { addProject, getProjects, toggleProjectStatus, type Project } from '@/lib/attendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Plus, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectManagerProps {
  refreshKey?: number;
  onUpdate?: () => void;
}

export default function ProjectManager({ refreshKey, onUpdate }: ProjectManagerProps) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const projects = getProjects();

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Inserisci il nome del progetto');
      return;
    }
    addProject({ name: trimmed, client: client.trim() || undefined, isActive: true });
    setName('');
    setClient('');
    toast.success(`Progetto "${trimmed}" creato`);
    onUpdate?.();
  };

  const handleToggle = (id: string) => {
    toggleProjectStatus(id);
    onUpdate?.();
  };

  const active = projects.filter(p => p.isActive);
  const inactive = projects.filter(p => !p.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Nuovo Progetto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="proj-name">Nome Progetto *</Label>
              <Input
                id="proj-name"
                placeholder="es. Ristrutturazione Via Roma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="proj-client">Cliente (opzionale)</Label>
              <Input
                id="proj-client"
                placeholder="es. Comune di Milano"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Briefcase className="h-4 w-4" /> Crea Progetto
          </Button>
        </CardContent>
      </Card>

      {/* Active projects */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Progetti Attivi ({active.length})
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun progetto attivo.</p>
        ) : (
          <div className="space-y-2">
            {active.map(p => (
              <ProjectRow key={p.id} project={p} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>

      {/* Inactive projects */}
      {inactive.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Progetti Chiusi ({inactive.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {inactive.map(p => (
              <ProjectRow key={p.id} project={p} onToggle={handleToggle} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({ project, onToggle }: { project: Project; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">{project.name}</p>
          {project.client && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {project.client}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={project.isActive ? 'default' : 'secondary'} className="text-xs">
          {project.isActive ? 'Attivo' : 'Chiuso'}
        </Badge>
        <Switch checked={project.isActive} onCheckedChange={() => onToggle(project.id)} />
      </div>
    </div>
  );
}
