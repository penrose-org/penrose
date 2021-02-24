# Installation
We have a detailed wiki page on how to get Penrose up and running on your computer [here](https://github.com/penrose/penrose/wiki/Building-and-running). :partying_face: Come back when you are done.

After following the Building & Running page, you should now have your own directory to run your code. It might look something like this,

![initialize files](https://github.com/penrose/penrose/blob/docs-edit/assets/tutorial/initializa_file.png)

Before getting into the granularity of code, a basic understanding of a Penrose program will make you feel less overwhelmed. Learning a new environment can be intimidating, and we want to make it as smooth as possible.

# How do we diagram by hand?

Now, for a second, I want you to recall how you would normally diagram a concept using a pen or pencil. 

It will most likely involve the following steps,
* **Decide on what you are diagramming**
    * There must be something that you want to diagram, so you are here pondering how to diagram it. 
    * Let's say we are making a diagram of things in your house, then the **domain** of objects that we are working with includes furnitures, plants, utensils, and everything that is in your house. Furthermore, furniture / plants / utensils are specific types of objects in your houses (the domain). 
* **Have a (mental) list of the objects you want to include in the diagram**
    * We either write down, or mentally construct the list of objects that will be included in our diagram.
    * They are the **substances** of our diagram that will be visualized. 
    * For example, your chair :chair: is a particular instance of an object in the domain :house:, and :chair: has the type of _furniture_. If the chair is in the diagram, then it is a substance of the diagram. 
* **Figure out the relationships between the objects**
    *  If we were only to put the list of things on paper one by one, that would not be an interesting nor useful diagram. Normally, there are relationships that we want to visualize. 
    * For example, we could group the plants based on the number of times they need to be watered on a weekly basis. Then we would have visual clusters of elements.
* **Explore different visual styles**
    * Drawings commonly require explorations and various attempts with colors, sizes, and compositions. The same concept can be visualized in a number of different **styles**. 

### The process of creating a Penrose diagram is similar to our intuitive process of analogue diagramming. :tada: 

![chair in house & vector in linear algebra](https://github.com/penrose/penrose/blob/docs-edit/assets/tutorial/chair-vector.jpg)

Let's circle back to what Penrose is meant to do: create beautiful diagrams from mathematical statements. The relationship between a chair being an object in a house, is the same as a vector being an object in Linear Algebra. With Penrose, you can build any mathematical domain with concepts that you wish to visualize. :paintbrush:

# What makes a Penrose program? 
It follows naturally from the process of diagramming by hand, we need to keep track of certain information as described above. The way we do that is by writing code in three specific files. First, we need to define our **domain** of objects because Penrose does not know what is in your house, or what a chair is. You need to define the types of objects and operations in your domain. For example, you can _push_ a chair, or _sit_ on a chair, which are operations related to a chair. Second, we need to store the specific **substances** we want to include in our diagrams, so Penrose knows exactly what to draw for you. Lastly, we need to define the **styles** that we want to visualize our substances in. Each of these corresponds to a specific file with an intuitive file extension designed for accessibility. 

![Triple Diagram](https://github.com/penrose/penrose/blob/docs-edit/assets/tutorial/triple_helvetica.png)

Every Penrose program consists of 3 files: 
* A `.dsl`  file that defines the language specific to the domain. 
* A `.sub` file that creates substances of mathematical content.
* A `.sty` file that specifies the style of the visual representation.

> dsl stands for Domain Specific Language. 

In general, for each diagram, you will have an individual `.sub` file that contains the specific instances for the diagram, while the `.dsl` and `.sty` files can be applied to a number of different diagrams. For example, we can have various diagrams in the domain of Linear Algebra that visualizes different concepts with different `.sub` files, but we would have a main `linearAlgebra.dsl` file and maybe several `linearAlgebra.sty` file for different styles. 