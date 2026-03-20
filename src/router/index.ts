import { createRouter, createWebHistory } from "vue-router";
import Home from "@/components/Home.vue";
import Counter from "@/components/Counter.vue";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/", component: Home },
		{ path: "/counter", component: Counter }
	]
});

export default router;