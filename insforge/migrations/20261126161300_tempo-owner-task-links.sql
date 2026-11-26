alter table public.task_repeat_cfgs
  add constraint task_repeat_cfgs_user_id_id_key unique (user_id, id);

alter table public.tasks
  add constraint tasks_user_id_id_key unique (user_id, id);

alter table public.tasks
  drop constraint tasks_repeat_cfg_id_fkey,
  drop constraint tasks_parent_task_id_fkey,
  add constraint tasks_user_id_repeat_cfg_id_fkey
    foreign key (user_id, repeat_cfg_id)
    references public.task_repeat_cfgs (user_id, id) match simple,
  add constraint tasks_user_id_parent_task_id_fkey
    foreign key (user_id, parent_task_id)
    references public.tasks (user_id, id) match simple;
