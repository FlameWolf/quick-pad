import { createRouter, createWebHistory } from "vue-router";
import DisplayNoteList from "@/components/DisplayNoteList.vue";
import EditNote from "@/components/EditNote.vue";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/", redirect: "/notes" },
		{ path: "/notes", component: DisplayNoteList },
		{ path: "/notes/new", component: EditNote },
		{ path: "/notes/:id", component: EditNote, props: true }
	]
});

export default router;