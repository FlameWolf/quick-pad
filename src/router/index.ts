import { createRouter, createWebHistory } from "vue-router";
import DisplayNoteList from "@/components/DisplayNoteList.vue";
import EditNote from "@/components/EditNote.vue";

const listViewRoutes = ["/notes", "/notes/archive", "/notes/trash"];
const scrollPositions = new Map<string, number>();
const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/", redirect: "/notes" },
		{ path: "/archive", redirect: "/notes/archive" },
		{ path: "/trash", redirect: "/notes/trash" },
		{
			path: "/notes",
			component: DisplayNoteList,
			props: {
				view: "active"
			}
		},
		{
			path: "/notes/archive",
			component: DisplayNoteList,
			props: {
				view: "archived"
			}
		},
		{
			path: "/notes/trash",
			component: DisplayNoteList,
			props: {
				view: "trash"
			}
		},
		{ path: "/notes/new", component: EditNote },
		{ path: "/notes/:id", component: EditNote, props: true }
	]
});
router.beforeEach((_, from) => {
	const fromPath = from.path;
	if (listViewRoutes.includes(fromPath)) {
		scrollPositions.set(fromPath, globalThis.scrollY);
	}
});
router.afterEach((to, _) => {
	const toPath = to.path;
	const scrollTop = (listViewRoutes.includes(toPath) && scrollPositions.get(toPath)) || 0;
	setTimeout(() => {
		globalThis.scrollTo(0, scrollTop);
	});
});

export default router;