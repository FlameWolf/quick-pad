# Plan for revised Tags List control

The control will initially load all tags from the central store with Select/Deselect All, Delete, Search, and Add options on top.

## When a user selects one or more tags

### Case 1: The user is in FILTER mode

- The internal tag filter will be in sync with the global tag filter
- Updating the global tag filter will update the internal tag filter and vice versa

### Case 2: The user is in SELECT mode

- The internal tag filter will be different from the global tag filter
- The global tag filter cannot be updated while the user is in EDIT mode
- Updating the internal tag filter will not update the global tag filter

### Case 3: The user is in EDIT mode

- The internal tag filter will be different from the global tag filter
- The global tag filter cannot be updated while the user is in EDIT mode
- Updating the internal tag filter will not update the global tag filter

## Observation

Case #2 and Case #3 are practically the same for the time being