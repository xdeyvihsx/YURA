import * as React from "react"
import { ChevronRight, Clock, Command, Download, Heart, Home, Library, ListMusic, Mic, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuAction,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { createPlaylist, deletePlaylist, renamePlaylist, useLibrary } from "@/services/library"
import type { View } from "@/lib/view"

const user = { name: "Usuario", email: "usuario@yura.com", avatar: "/avatars/user.jpg" }
const VISIBLE_PLAYLISTS = 6

/** Small name form used for creating and renaming playlists. */
function NameForm({ initial = "", cta, onSubmit }: { initial?: string; cta: string; onSubmit: (name: string) => void }) {
  const [name, setName] = React.useState(initial)
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()) }}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la playlist" maxLength={60} />
      <button type="submit" disabled={!name.trim()} className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{cta}</button>
    </form>
  )
}

function PlaylistItem({ id, name, active, onOpen, onDeleted }: { id: string; name: string; active: boolean; onOpen: () => void; onDeleted: () => void }) {
  const [renaming, setRenaming] = React.useState(false)
  return (
    <SidebarMenuItem>
      <Popover open={renaming} onOpenChange={setRenaming}>
        <PopoverAnchor asChild>
          <SidebarMenuButton isActive={active} onClick={onOpen}>
            <ListMusic />
            <span>{name}</span>
          </SidebarMenuButton>
        </PopoverAnchor>
        <PopoverContent side="right" align="start" className="w-64">
          <p className="mb-2 text-sm font-semibold">Cambiar nombre</p>
          <NameForm initial={name} cta="Guardar" onSubmit={(n) => { renamePlaylist(id, n); setRenaming(false) }} />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover><MoreHorizontal /><span className="sr-only">Opciones</span></SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44" side="right" align="start">
          <DropdownMenuItem onSelect={onOpen}><ListMusic className="text-muted-foreground" /> Abrir</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => setRenaming(true), 0)}><Pencil className="text-muted-foreground" /> Cambiar nombre</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { deletePlaylist(id); onDeleted() }}><Trash2 className="text-muted-foreground" /> Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export function AppSidebar({ view, onNavigate, onSearchClick, ...props }: React.ComponentProps<typeof Sidebar> & { view: View; onNavigate: (v: View) => void; onSearchClick: () => void }) {
  const { playlists } = useLibrary()
  const [creating, setCreating] = React.useState(false)
  const library: { title: string; view: View; icon: typeof Heart }[] = [
    { title: "Recientes", view: "recents", icon: Clock },
    { title: "Favoritos", view: "favorites", icon: Heart },
    { title: "Descargas", view: "downloads", icon: Download },
    { title: "Podcasts", view: "podcasts", icon: Mic },
  ]

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => onNavigate("home")}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">YURA</span>
                <span className="truncate text-xs">Music</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Inicio" isActive={view === "home"} onClick={() => onNavigate("home")}><Home /><span>Inicio</span></SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Buscar" isActive={view === "search"} onClick={onSearchClick}><Search /><span>Buscar</span></SidebarMenuButton>
            </SidebarMenuItem>
            <Collapsible asChild defaultOpen>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Tu Biblioteca" ><Library /><span>Tu Biblioteca</span></SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="data-[state=open]:rotate-90"><ChevronRight /><span className="sr-only">Mostrar</span></SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {library.map((l) => (
                      <SidebarMenuSubItem key={l.title}>
                        <SidebarMenuSubButton asChild isActive={view === l.view}>
                          <button type="button" className="w-full" onClick={() => onNavigate(l.view)}><l.icon /><span>{l.title}</span></button>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Tus Playlists</SidebarGroupLabel>
          <SidebarMenu>
            {!playlists.length && <p className="px-2 py-1 text-xs text-muted-foreground">Crea tu primera playlist abajo.</p>}
            {playlists.slice(0, VISIBLE_PLAYLISTS).map((p) => (
              <PlaylistItem key={p.id} id={p.id} name={p.name} active={view === `playlist:${p.id}`} onOpen={() => onNavigate(`playlist:${p.id}`)} onDeleted={() => view === `playlist:${p.id}` && onNavigate("playlists")} />
            ))}
            {playlists.length > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton isActive={view === "playlists"} onClick={() => onNavigate("playlists")}>
                  <MoreHorizontal />
                  <span>{playlists.length > VISIBLE_PLAYLISTS ? `Ver todas (${playlists.length})` : "Ver todas"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <Popover open={creating} onOpenChange={setCreating}>
                <PopoverTrigger asChild>
                  <SidebarMenuButton size="sm"><Plus /><span>Crear Playlist</span></SidebarMenuButton>
                </PopoverTrigger>
                <PopoverContent side="right" align="end" className="w-64">
                  <p className="mb-2 text-sm font-semibold">Nueva playlist</p>
                  <NameForm cta="Crear" onSubmit={(n) => { const p = createPlaylist(n); setCreating(false); onNavigate(`playlist:${p.id}`) }} />
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
